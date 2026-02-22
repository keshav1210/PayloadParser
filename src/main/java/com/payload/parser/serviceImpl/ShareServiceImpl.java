package com.payload.parser.serviceImpl;

import com.github.benmanes.caffeine.cache.Cache;
import com.payload.parser.model.ShareMeta;
import com.payload.parser.service.ShareService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.UUID;

@Service
public class ShareServiceImpl implements ShareService {
    private static final long MAX_FILE_SIZE = 300 * 1024; // 300 KB
    @Autowired
    private Cache<String, ShareMeta> cache;

    public String saveText(String text, boolean oneTime) {
        String token = generateToken();

        ShareMeta meta = ShareMeta.forText(text);
        meta.setOneTimeDownload(oneTime);

        cache.put(token, meta);
        return token;
    }

    public String saveFile(MultipartFile file, boolean oneTime) throws IOException {

        validateFile(file);

        String token =generateToken();

        ShareMeta meta = ShareMeta.forFile(
                file.getBytes(),
                file.getOriginalFilename(),
                file.getContentType()
        );

        meta.setOneTimeDownload(oneTime);

        cache.put(token, meta);
        return token;
    }

    public void validateFile(MultipartFile file) {
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException(
                    "File too large. Max allowed is 300 KB"
            );
        }
    }


    private static final String CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private String generateToken() {
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
