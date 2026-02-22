package com.payload.parser.model;

public class ShareResponse {

    private boolean success;
    private String message;
    private String url;

    public ShareResponse(boolean success, String message, String url) {
        this.success = success;
        this.message = message;
        this.url = url;
    }

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getUrl() { return url; }
}
