package com.payload.parser.model;

public class ShareTextRequest {

    private String text;
    private boolean oneTimeDownload;

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
}
