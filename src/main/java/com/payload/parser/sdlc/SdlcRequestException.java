package com.payload.parser.sdlc;

/** Invalid input from the generator form; reported to the caller as HTTP 400. */
public class SdlcRequestException extends RuntimeException {

    public SdlcRequestException(String message) {
        super(message);
    }
}
