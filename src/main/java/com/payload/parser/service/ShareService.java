package com.payload.parser.service;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface ShareService {
    public String saveText(String text, boolean oneTime);
    public String saveText(String text, boolean oneTime, String sourcePage);
    public String saveFile(MultipartFile file, boolean oneTime) throws IOException;
    public String saveFile(MultipartFile file, boolean oneTime, String sourcePage) throws IOException;
}
