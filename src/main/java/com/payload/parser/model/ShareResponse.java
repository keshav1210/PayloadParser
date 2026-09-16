package com.payload.parser.model;

public class ShareResponse {

    private boolean success;
    private String message;
    private String url;
    private String token;
    private boolean emailSent;
    private String mailtoUrl;

    public ShareResponse(boolean success, String message, String url) {
        this.success = success;
        this.message = message;
        this.url = url;
    }

    public ShareResponse(boolean success, String message, String url, String token, boolean emailSent, String mailtoUrl) {
        this.success = success;
        this.message = message;
        this.url = url;
        this.token = token;
        this.emailSent = emailSent;
        this.mailtoUrl = mailtoUrl;
    }

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getUrl() { return url; }
    public String getToken() { return token; }
    public boolean isEmailSent() { return emailSent; }
    public String getMailtoUrl() { return mailtoUrl; }

    public void setSuccess(boolean success) { this.success = success; }
    public void setMessage(String message) { this.message = message; }
    public void setUrl(String url) { this.url = url; }
    public void setToken(String token) { this.token = token; }
    public void setEmailSent(boolean emailSent) { this.emailSent = emailSent; }
    public void setMailtoUrl(String mailtoUrl) { this.mailtoUrl = mailtoUrl; }
}
