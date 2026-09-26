package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Validates YAML and rewrites it with consistent indentation.
 * Errors come back as "line N, column M: message".
 */
@Service
public class YamlFormatServiceImpl implements ParserService {

    private static final YAMLMapper WRITER = YAMLMapper.builder()
            .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
            .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES)
            .enable(YAMLGenerator.Feature.ALWAYS_QUOTE_NUMBERS_AS_STRINGS)
            .enable(YAMLGenerator.Feature.INDENT_ARRAYS_WITH_INDICATOR)
            .build();

    @Override
    public Response parse(Request request) {
        List<JsonNode> docs;
        try {
            docs = YamlSupport.readDocuments(request.getData());
        } catch (IllegalArgumentException e) {
            return new Response(false, e.getMessage(), null, HttpStatus.BAD_REQUEST.toString());
        }
        try {
            List<String> parts = new ArrayList<>();
            for (JsonNode doc : docs) {
                parts.add(WRITER.writeValueAsString(doc).stripTrailing());
            }
            return new Response(true, "success", String.join("\n---\n", parts) + "\n", HttpStatus.OK.toString());
        } catch (JsonProcessingException e) {
            return new Response(false, "line 1, column 1: " + e.getOriginalMessage(), null, HttpStatus.BAD_REQUEST.toString());
        }
    }

    @Override
    public String getType() {
        return "YAML_FORMAT";
    }
}
