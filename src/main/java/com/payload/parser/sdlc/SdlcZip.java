package com.payload.parser.sdlc;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Packs a kit as a ZIP whose entries sit at the root, ready to unzip into a project folder. */
public final class SdlcZip {

    private SdlcZip() {
    }

    public static byte[] write(Map<String, String> files) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream(64 * 1024);
        FileTime now = FileTime.from(Instant.now());
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            for (Map.Entry<String, String> f : files.entrySet()) {
                ZipEntry entry = new ZipEntry(f.getKey());
                entry.setLastModifiedTime(now);
                zip.putNextEntry(entry);
                zip.write(f.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        } catch (IOException e) {
            throw new IllegalStateException("Could not create the ZIP", e);
        }
        return bytes.toByteArray();
    }
}
