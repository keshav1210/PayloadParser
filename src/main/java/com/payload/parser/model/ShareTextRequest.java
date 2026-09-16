package com.payload.parser.model;

public class ShareTextRequest {

    private String text;
    private boolean oneTimeDownload;
    private String sourcePage;
    private String email;

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public boolean isOneTimeDownload() {
        return oneTimeDownload;
    }

    public void setOneTimeDownload(boolean oneTimeDownload) {
        this.oneTimeDownload = oneTimeDownload;
    }

    public String getSourcePage() {
        return sourcePage;
    }

    public void setSourcePage(String sourcePage) {
        this.sourcePage = sourcePage;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}
