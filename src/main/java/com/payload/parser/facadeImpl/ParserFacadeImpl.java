package com.payload.parser.facadeImpl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.payload.parser.enumration.Type;
import com.payload.parser.facade.ParserFacade;
import com.payload.parser.model.ConvertRequest;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ObjectConverter;
import com.payload.parser.service.ParserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class ParserFacadeImpl implements ParserFacade {

    private final Map<String, ParserService> parserMap;
    ParserService service;
    @Autowired
    ObjectConverter objectConverter;

    public ParserFacadeImpl(List<ParserService> services) {
        this.parserMap = services.stream()
                .collect(Collectors.toMap(ParserService::getType, s -> s));
    }

    @Override
    public Response parse(Request request) {
        service = parserMap.get(request.getType().name());
        return service.parse(request);
    }

    @Override
    public String objectToJson(ConvertRequest request) throws JsonProcessingException {
        return objectConverter.converter(request);
    }

}
