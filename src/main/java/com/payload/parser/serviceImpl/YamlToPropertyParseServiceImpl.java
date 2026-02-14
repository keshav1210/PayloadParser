package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import com.payload.parser.utils.CommonUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringWriter;
import java.util.Map;
import java.util.Properties;

@Service
public class YamlToPropertyParseServiceImpl implements ParserService {

    private static final YAMLMapper yamlMapper = new YAMLMapper();

    @Override
    public Response parse(Request request) {
        JsonNode root = null;
        try {
            root = yamlMapper.readTree(request.getData());
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
        Map<String, Object> flatMap = CommonUtils.flatten(root, "");  // Reuse from JsonToCsvConverter

        Properties props = new Properties();
        flatMap.forEach((key, value) -> props.setProperty(key, String.valueOf(value)));

        StringWriter sw = new StringWriter();
        try {
            props.store(sw, null);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }

        String output = sw.toString();
        // Remove first line: #timestamp
        if (output.startsWith("#")) {
            int end = output.indexOf("\n", 1) + 1;
            output = output.substring(end);
        }

        return new Response(true, "success", output, HttpStatus.OK.toString());
    }

    @Override
    public String getType() {
        return "YAML_TO_PROPERTY";
    }
}
