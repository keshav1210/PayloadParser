package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class XmlToYamlParseServiceImpl implements ParserService {
    private static final XmlMapper xmlMapper = new XmlMapper();

    private static final YAMLMapper yamlMapper = new YAMLMapper()
            .disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
            .enable(YAMLGenerator.Feature.MINIMIZE_QUOTES);

    @Override
    public Response parse(Request request) {
        try{
            JsonNode tree = xmlMapper.readTree(request.getData().getBytes());
            return new Response(true, "success",
                    yamlMapper.writerWithDefaultPrettyPrinter().writeValueAsString(tree),
                    HttpStatus.OK.toString()
            );
        } catch (Exception e) {
            throw new RuntimeException("Invalid XML input");
        }
    }

    @Override
    public String getType() {
        return "XML_TO_YAML";
    }
}
