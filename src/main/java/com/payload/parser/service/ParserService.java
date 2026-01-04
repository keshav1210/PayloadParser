package com.payload.parser.service;

import com.payload.parser.model.Request;
import com.payload.parser.model.Response;

public interface ParserService {
    public Response parse(Request request);
}
