package com.payload.parser.facade;

import com.payload.parser.model.Request;
import com.payload.parser.model.Response;

public interface ParserFacade {
    public Response parse(Request request);
}
