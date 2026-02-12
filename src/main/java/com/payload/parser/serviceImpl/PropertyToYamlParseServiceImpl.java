package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.StringReader;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

@Service
public class PropertyToYamlParseServiceImpl implements ParserService {

    private static final YAMLMapper yamlMapper = YAMLMapper.builder()
            .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
            .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES)
            .enable(SerializationFeature.INDENT_OUTPUT)
            .build();

    @Override
    public Response parse(Request request) {
        try {
            Properties properties = new Properties();
            properties.load(new StringReader(request.getData()));

            Map<String, Object> root = new LinkedHashMap<>();

            for (String key : properties.stringPropertyNames()) {
                insert(root, key.split("\\."), normalize(properties.getProperty(key)));
            }

            return new Response(true, "success",
                    yamlMapper.writeValueAsString(root),
                    HttpStatus.OK.toString()
            );
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public String getType() {
        return "PROPERTY_TO_YAML";
    }

    @SuppressWarnings("unchecked")
    private static void insert(
            Map<String, Object> current,
            String[] path,
            Object value
    ) {

        for (int i = 0; i < path.length; i++) {
            String key = path[i];

            if (i == path.length - 1) {
                current.put(key, value);
            } else {
                current = (Map<String, Object>)
                        current.computeIfAbsent(key, k -> new LinkedHashMap<>());
            }
        }
    }

    private static Object normalize(String value) {
        value = value.trim();

        if ((value.startsWith("'") && value.endsWith("'")) ||
                (value.startsWith("\"") && value.endsWith("\""))) {
            value = value.substring(1, value.length() - 1);
        }

        if ("true".equalsIgnoreCase(value)) return true;
        if ("false".equalsIgnoreCase(value)) return false;
        if ("null".equalsIgnoreCase(value)) return null;

        if (value.matches("-?\\d+")) return Integer.parseInt(value);
        if (value.matches("-?\\d+\\.\\d+")) return Double.parseDouble(value);

        return value;
    }
}
