package com.payload.parser.serviceImpl;

import com.payload.parser.service.EmailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Service
public class EmailServiceImpl implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailServiceImpl.class);

//    @Value("${spring.mail.host:}")
//    private String mailHost;
//
//    @Value("${spring.mail.username:}")
//    private String mailUsername;

    @Value("${email.api.key}")
    private String emailApiKey;

    private final RestClient restClient;

    public EmailServiceImpl(RestClient.Builder builder) {
        this.restClient = builder
                .baseUrl("https://api.brevo.com/v3")
                .build();
    }

    @Value("${spring.mail.from:jsonxmleditor@gmail.com}")
    private String mailFrom;

    /*@Override
    public boolean sendShareEmail(String recipientEmail, String token, String shareUrl, String sourcePage) {
        if (recipientEmail == null || recipientEmail.isBlank()) {
            return false;
        }

        if (mailHost == null || mailHost.isBlank() || mailUsername == null || mailUsername.isBlank()) {
            log.info("SMTP credentials not fully configured. Falling back to client email dispatch.");
            return false;
        }

        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            log.warn("JavaMailSender bean is not available. Skipping server-side SMTP email.");
            return false;
        }

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(recipientEmail.trim());
            helper.setFrom(mailFrom);
            helper.setSubject("Shared Data Drop - Key: " + token);

            String safeUrl = normalizeShareUrl(shareUrl);
            String toolName = getToolName(sourcePage);
            String htmlContent = buildEmailHtml(token, safeUrl, toolName);
            helper.setText(htmlContent, true);

            sender.send(message);
            log.info("Successfully sent share email for token {} to {}", token, recipientEmail);
            return true;
        } catch (Exception e) {
            log.error("Failed to send email via SMTP: {}", e.getMessage());
            return false;
        }
    }*/

    @Override
    public boolean sendShareEmail(
            String recipientEmail,
            String token,
            String shareUrl,
            String sourcePage) {

        if (recipientEmail == null || recipientEmail.isBlank()) {
            return false;
        }

        if (emailApiKey == null || emailApiKey.isBlank()) {
            log.warn("Brevo API key not configured. Skipping server-side email.");
            return false;
        }

        try {
            String apiKey = emailApiKey.trim();
            String safeUrl = normalizeShareUrl(shareUrl);

            String toolName = getToolName(sourcePage);
            String htmlContent = buildEmailHtml(token, safeUrl, toolName);

            Map<String, Object> requestBody = Map.of(
                    "sender", Map.of(
                            "email", mailFrom
                    ),
                    "to", new Object[]{
                            Map.of(
                                    "email", recipientEmail.trim()
                            )
                    },
                    "subject", "Shared Data Drop - Key: " + token,
                    "htmlContent", htmlContent
            );

            restClient.post()
                    .uri("/smtp/email")
                    .header("api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .toBodilessEntity();

            log.info(
                    "Successfully sent share email for token {} to {}",
                    token,
                    recipientEmail
            );

            return true;

        } catch (Exception e) {

            log.error(
                    "Failed to send email via Brevo API: {}",
                    e.getMessage(),
                    e
            );

            return false;
        }
    }

    @Override
    public String generateMailtoUrl(String recipientEmail, String token, String shareUrl, String sourcePage) {
        String safeUrl = normalizeShareUrl(shareUrl);
        String tool = getToolName(sourcePage);
        String subject = "Shared Data Drop - Key: " + token;
        String body = "Hi,\n\nHere is your shared data drop from JSON XML Editor (" + tool + ").\n\n" +
                "🔑 Drop Key: " + token + "\n" +
                "🔗 Direct Link: " + safeUrl + "\n\n" +
                "You can access or receive the drop using the key or direct link above.";

        String email = recipientEmail != null ? recipientEmail.trim() : "";
        return "mailto:" + email +
                "?subject=" + URLEncoder.encode(subject, StandardCharsets.UTF_8).replace("+", "%20") +
                "&body=" + URLEncoder.encode(body, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private String normalizeShareUrl(String shareUrl) {
        if (shareUrl == null || shareUrl.isBlank()) {
            return "http://localhost:8085";
        }
        String trimmed = shareUrl.trim();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            return "http://" + trimmed;
        }
        return trimmed;
    }

    private String getToolName(String sourcePage) {
        if (sourcePage == null || sourcePage.isBlank()) return "Share Drop";
        return switch (sourcePage.toLowerCase()) {
            case "/json-parser" -> "JSON Parser";
            case "/xml-parser" -> "XML Parser";
            case "/csv-converter" -> "CSV Converter";
            case "/yaml-converter" -> "YAML Converter";
            case "/toml-converter" -> "TOML Converter";
            case "/mapper" -> "Object Mapper";
            case "/parser" -> "JSON XML Editor";
            default -> "Share Drop";
        };
    }

    private String buildEmailHtml(String token, String shareUrl, String toolName) {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0c0d14; color: #ddddf0; margin: 0; padding: 20px; }
                    .card { max-width: 540px; margin: 20px auto; background-color: #12131c; border: 1px solid #28283a; border-radius: 16px; padding: 32px 28px; text-align: center; }
                    .badge { display: inline-block; background: rgba(0, 221, 179, 0.12); color: #00ddb3; font-family: monospace; font-size: 22px; font-weight: bold; letter-spacing: 2px; padding: 10px 24px; border-radius: 10px; border: 1px solid rgba(0, 221, 179, 0.3); margin: 20px 0; }
                    .btn { display: inline-block; background: linear-gradient(135deg, #4f8cff, #00ddb3); color: #ffffff !important; text-decoration: none; font-weight: bold; font-size: 15px; padding: 13px 32px; border-radius: 10px; margin-top: 10px; }
                    .footer { font-size: 12px; color: #6b6b80; margin-top: 26px; line-height: 1.6; }
                    h2 { color: #ffffff; margin-top: 0; }
                    p { color: #a4a4b8; font-size: 14px; line-height: 1.6; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h2>Shared Data Drop</h2>
                    <p>A data snippet or file has been shared with you from <strong>""" + toolName + """
                    </strong>.</p>
                    <div style="font-size: 12px; text-transform: uppercase; color: #8a8a9e; letter-spacing: 1px;">Your Drop Key</div>
                    <div class="badge">""" + token + """
                    </div>
                    <div>
                      <a href=\"""" + shareUrl + """
                      " class="btn" target="_blank">Open Shared Data</a>
                    </div>
                    <div class="footer">
                      <p>Or visit <a href=\"""" + shareUrl + """
                      " style="color:#4f8cff;">""" + shareUrl + """
                      </a><br>
                      This temporary drop will expire shortly.</p>
                    </div>
                  </div>
                </body>
                </html>
                """;
    }
}
