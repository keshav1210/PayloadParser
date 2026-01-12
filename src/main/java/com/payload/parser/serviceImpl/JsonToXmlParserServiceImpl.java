package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.fasterxml.jackson.dataformat.xml.ser.ToXmlGenerator;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class JsonToXmlParserServiceImpl implements ParserService {
    private static final ObjectMapper jsonMapper = new ObjectMapper();
    private static final XmlMapper xmlMapper = (XmlMapper) new XmlMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    @Override
    public Response parse(Request request) {
        try {
            JsonNode jsonNode = jsonMapper.readTree(request.getData());
            xmlMapper.configure(ToXmlGenerator.Feature.WRITE_XML_DECLARATION, true);
            if(jsonNode.isArray()){
                ObjectNode wrapper = jsonMapper.createObjectNode();
                wrapper.set("item", jsonNode);
                return new Response(true, "success", xmlMapper.writer().withRootName("root").writeValueAsString(wrapper), HttpStatus.OK.toString());
            }
            return new Response(true, "success", xmlMapper.writer().withRootName("root").writeValueAsString(jsonNode), HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException("Invalid JSON input");
        }
    }

    @Override
    public String getType() {
        return "JSON_TO_XML";
    }
}
