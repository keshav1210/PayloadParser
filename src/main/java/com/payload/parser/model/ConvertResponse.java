package com.payload.parser.model;

public class ConvertResponse {
    private String convertedCode;
    private String error;

    // Constructors
    public ConvertResponse() {
    }

    public ConvertResponse(String convertedCode, String error) {
        this.convertedCode = convertedCode;
        this.error = error;
    }

    // Getters and Setters
    public String getConvertedCode() {
        return convertedCode;
    }

    public void setConvertedCode(String convertedCode) {
        this.convertedCode = convertedCode;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }
}
