package com.payload.parser.sdlc;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sdlc")
public class SdlcController {

    private static final Logger log = LoggerFactory.getLogger(SdlcController.class);
    static final long MAX_BODY_BYTES = 2L * 1024 * 1024;

    private final SdlcGeneratorService generator;
    private final SdlcTemplateStore store;

    public SdlcController(SdlcGeneratorService generator, SdlcTemplateStore store) {
        this.generator = generator;
        this.store = store;
    }

    @GetMapping(value = "/packs", produces = MediaType.APPLICATION_JSON_VALUE)
    public JsonNode packs() {
        return store.catalog();
    }

    @PostMapping(value = "/preview", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> preview(@RequestBody SdlcRequest request,
                                       @RequestParam(defaultValue = "project") String format, HttpServletRequest http) {
        checkSize(http);
        SdlcKit kit = generator.generate(request, SdlcEdition.of(format));
        List<Map<String, Object>> files = new ArrayList<>();
        int skills = 0, agents = 0, bytes = 0;
        for (Map.Entry<String, String> f : kit.files().entrySet()) {
            files.add(Map.of("path", f.getKey(), "content", f.getValue()));
            if (f.getKey().matches("(\\.claude/)?skills/[^/]+/SKILL\\.md")) skills++;
            if (f.getKey().matches("(\\.claude/)?agents/[^/]+\\.md")) agents++;
            bytes += f.getValue().length();
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("files", files);
        body.put("issues", kit.issues());
        body.put("summary", Map.of("files", files.size(), "commands", skills, "agents", agents, "bytes", bytes,
                "downloadable", !kit.hasErrors()));
        return body;
    }

    @PostMapping("/generate")
    public ResponseEntity<?> generate(@RequestBody SdlcRequest request,
                                      @RequestParam(defaultValue = "project") String format, HttpServletRequest http) {
        checkSize(http);
        SdlcEdition edition = SdlcEdition.of(format);
        SdlcKit kit = generator.generate(request, edition);
        if (kit.hasErrors()) {
            return ResponseEntity.unprocessableEntity().contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("message", "The kit has errors; see the preview.", "issues", kit.issues()));
        }
        byte[] zip = SdlcZip.write(kit.files());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(edition.fileName()).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(zip);
    }

    private static void checkSize(HttpServletRequest http) {
        if (http.getContentLengthLong() > MAX_BODY_BYTES) {
            throw new SdlcRequestException("The request is too large.");
        }
    }

    @ExceptionHandler(SdlcRequestException.class)
    public ResponseEntity<Map<String, String>> badRequest(SdlcRequestException e) {
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_JSON).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> unreadable(HttpMessageNotReadableException e) {
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_JSON).body(Map.of("message", "The request isn't valid JSON."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> failure(Exception e) {
        log.error("SDLC kit generation failed", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("message", "The kit couldn't be generated. Please try again."));
    }
}
