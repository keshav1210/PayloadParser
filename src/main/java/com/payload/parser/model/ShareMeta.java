package com.payload.parser.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.Instant;

@Data
@AllArgsConstructor

public class ShareMeta implements Serializable {

    private String type;

    // ===== TEXT =====
    private String textContent;

    // ===== FILE =====
    private byte[] fileBytes;
    private String fileName;
    private String contentType;

    // ===== COMMON =====
    private long size;              // used by Caffeine weigher
    private Instant createdAt;      // useful for debugging/cleanup
    private boolean oneTimeDownload; // future-ready flag

    // ===== Constructors =====
    public ShareMeta() {
        this.createdAt = Instant.now();
    }

    // ===== Factory methods (BEST PRACTICE) =====

    public static ShareMeta forText(String text) {
        ShareMeta meta = new ShareMeta();
        meta.type = "TEXT";
        meta.textContent = text;
        meta.size = text == null ? 0 : text.getBytes().length;
        return meta;
    }

    public static ShareMeta forFile(byte[] bytes,
                                    String fileName,
                                    String contentType) {
        ShareMeta meta = new ShareMeta();
        meta.type = "FILE";
        meta.fileBytes = bytes;
        meta.fileName = fileName;
        meta.contentType = contentType;
        meta.size = bytes == null ? 0 : bytes.length;
        return meta;
    }

}
