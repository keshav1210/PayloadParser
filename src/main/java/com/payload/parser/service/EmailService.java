package com.payload.parser.service;

public interface EmailService {
    boolean sendShareEmail(String recipientEmail, String token, String shareUrl, String sourcePage);
    String generateMailtoUrl(String recipientEmail, String token, String shareUrl, String sourcePage);
}
