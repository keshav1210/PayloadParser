package com.payload.parser.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.github.benmanes.caffeine.cache.Cache;
import com.payload.parser.facade.ParserFacade;
import com.payload.parser.model.*;
import com.payload.parser.service.EmailService;
import com.payload.parser.service.ShareService;
import com.payload.parser.serviceImpl.ObjectConverterServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/data")
@CrossOrigin("*")
public class RequestHandler {
    @Autowired
    private ParserFacade parserFacade;

    @Autowired
    ShareService shareService;

    @Autowired
    private EmailService emailService;

    @Value("${baseurl:http://localhost:8085}")
    private String baseUrl;

    @Autowired
    private Cache<String, ShareMeta> cache;

    @PostMapping("/parse")
    public ResponseEntity<Response> convert(@RequestBody Request request) {
        Response response = parserFacade.parse(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/object-to-json")
    public ResponseEntity<ConvertResponse> objectToJSON(@RequestBody ConvertRequest request) throws JsonProcessingException {
        if (request.getInputCode() == null || request.getInputCode().trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ConvertResponse(null, "Input code is required"));
        }

        // Call the conversion service
        String convertedCode = parserFacade.objectToJson(request);

        return ResponseEntity.ok(new ConvertResponse(convertedCode, null));
    }

    @PostMapping("share/text")
    public ResponseEntity<ShareResponse> shareText(
            @RequestBody ShareTextRequest request) {

        if (request.getText() == null || request.getText().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new ShareResponse(false, "Text cannot be empty", null));
        }

        String token = shareService.saveText(
                request.getText(),
                request.isOneTimeDownload(),
                request.getSourcePage()
        );

        String url = baseUrl + "/shared/" + token;
        boolean emailSent = false;
        String mailtoUrl = null;

        if (request.getEmail() != null && !request.getEmail().trim().isEmpty()) {
            emailSent = emailService.sendShareEmail(
                    request.getEmail().trim(),
                    token,
                    url,
                    request.getSourcePage()
            );
            if (!emailSent) {
                mailtoUrl = emailService.generateMailtoUrl(
                        request.getEmail().trim(),
                        token,
                        url,
                        request.getSourcePage()
                );
            }
        }

        return ResponseEntity.ok(
                new ShareResponse(true, "Text shared successfully", url, token, emailSent, mailtoUrl)
        );
    }

    // ================= FILE SHARE =================

    @PostMapping("/share/file")
    public ResponseEntity<ShareResponse> shareFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "false") boolean oneTimeDownload,
            @RequestParam(required = false) String sourcePage,
            @RequestParam(required = false) String email
    ) throws Exception {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new ShareResponse(false, "File is empty", null));
        }

        String token = shareService.saveFile(file, oneTimeDownload, sourcePage);

        String url = baseUrl + "/shared/" + token;
        boolean emailSent = false;
        String mailtoUrl = null;

        if (email != null && !email.trim().isEmpty()) {
            emailSent = emailService.sendShareEmail(
                    email.trim(),
                    token,
                    url,
                    sourcePage
            );
            if (!emailSent) {
                mailtoUrl = emailService.generateMailtoUrl(
                        email.trim(),
                        token,
                        url,
                        sourcePage
                );
            }
        }

        return ResponseEntity.ok(
                new ShareResponse(true, "File shared successfully", url, token, emailSent, mailtoUrl)
        );
    }

    @PostMapping("/share/email")
    public ResponseEntity<Map<String, Object>> sendShareEmail(
            @RequestBody Map<String, String> payload
    ) {
        String email = payload.get("email");
        String token = payload.get("token");
        String sourcePage = payload.get("sourcePage");

        if (email == null || email.isBlank() || token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Email and token are required"
            ));
        }

        String url = baseUrl + "/shared/" + token;
        boolean sent = emailService.sendShareEmail(email.trim(), token, url, sourcePage);
        String mailto = sent ? null : emailService.generateMailtoUrl(email.trim(), token, url, sourcePage);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "emailSent", sent,
                "mailtoUrl", mailto != null ? mailto : "",
                "message", sent ? "Email sent successfully" : "SMTP unavailable, use mailto fallback"
        ));
    }

    @GetMapping("/shared/{token}")
    public ResponseEntity<?> access(@PathVariable String token) {

        ShareMeta meta = cache.getIfPresent(token);

        if (meta == null) {
            throw new RuntimeException("Link expired or already used");
        }

        // ⭐ atomic remove only if one-time
        if (meta.isOneTimeDownload()) {
            boolean removed = cache.asMap().remove(token, meta);
            if (!removed) {
                throw new RuntimeException("Link already consumed");
            }
        }

        // ===== TEXT =====
        if (meta.getType().equals("TEXT")) {
            return ResponseEntity.ok(meta.getTextContent());
        }

        // ===== FILE =====
        ByteArrayResource resource =
                new ByteArrayResource(meta.getFileBytes());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + meta.getFileName() + "\"")
                .header(HttpHeaders.CONTENT_TYPE,
                        meta.getContentType() != null
                                ? meta.getContentType()
                                : "application/octet-stream")
                .body(resource);
    }
}
