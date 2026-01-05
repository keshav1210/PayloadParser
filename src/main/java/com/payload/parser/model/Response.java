package com.payload.parser.model;

public class Response {
    private boolean success;
    private String message;
    private String parsedData;
    private String code;

    public Response(){}

    public Response(boolean success, String message, String parsedData, String code) {
        this.success = success;
        this.message = message;
        this.parsedData = parsedData;
        this.code = code;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getParsedData() {
        return parsedData;
    }

    public void setParsedData(String parsedData) {
        this.parsedData = parsedData;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
