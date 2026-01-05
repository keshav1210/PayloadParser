package com.payload.parser.facadeImpl;

import com.payload.parser.facade.ParserFacade;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ParserFacadeImpl implements ParserFacade {

    private final Map<String, ParserService> parserMap;

    public ParserFacadeImpl(List<ParserService> services) {
        this.parserMap = services.stream()
                .collect(Collectors.toMap(ParserService::getType, s -> s));
    }

    @Override
    public Response parse(Request request) {
        Response response = null;
        switch (request.getType()) {
            case JSON_TO_XML:
                break;
            case JSON_FORMAT:
                ParserService service = parserMap.get(request.getType().name());
                response = service.parse(request);
                break;
            case XML_FORMAT:
                break;
            case XML_TO_JSON:
                break;
        }
        return response;
    }

}
