package com.payload.parser.model;


public class ConvertRequest {
    private String inputCode;
    private String inputLang;
    private String outputLang;
    private String outputFormat;
    private String javaOptions;      // "lombok" or "standard"
    private String constructorOptions;

    // Constructors
    public ConvertRequest() {
    }

    public ConvertRequest(String inputCode, String inputLang, String outputLang, String outputFormat) {
        this.inputCode = inputCode;
        this.inputLang = inputLang;
        this.outputLang = outputLang;
        this.outputFormat = outputFormat;
    }

    // Getters and Setters
    public String getInputCode() {
        return inputCode;
    }

    public void setInputCode(String inputCode) {
        this.inputCode = inputCode;
    }

    public String getInputLang() {
        return inputLang;
    }

    public void setInputLang(String inputLang) {
        this.inputLang = inputLang;
    }

    public String getOutputLang() {
        return outputLang;
    }

    public void setOutputLang(String outputLang) {
        this.outputLang = outputLang;
    }

    public String getOutputFormat() {
        return outputFormat;
    }

    public void setOutputFormat(String outputFormat) {
        this.outputFormat = outputFormat;
    }

    public String getJavaOptions() {
        return javaOptions;
    }

    public void setJavaOptions(String javaOptions) {
        this.javaOptions = javaOptions;
    }

    public String getConstructorOptions() {
        return constructorOptions;
    }

    public void setConstructorOptions(String constructorOptions) {
        this.constructorOptions = constructorOptions;
    }
}