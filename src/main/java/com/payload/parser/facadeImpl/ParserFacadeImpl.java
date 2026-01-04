package com.payload.parser.facadeImpl;

import com.payload.parser.facade.ParserFacade;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;

public class ParserFacadeImpl implements ParserFacade {

    @Override
    public Response parse(Request request) {
        switch (request.getType()){
            case JSON_TO_XML:
                break;
            case JSON_FORMAT:
                break;
            case XML_FORMAT:
                break;
            case XML_TO_JSON:
                break;
        }
        return null;
    }
}
