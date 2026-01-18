package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.fasterxml.jackson.dataformat.xml.ser.ToXmlGenerator;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class XmlSortServiceImpl implements ParserService {

    private static final XmlMapper xmlMapper = (XmlMapper) new XmlMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    @Override
    public Response parse(Request request) {
        return sortXml(request.getData(), true, false);
    }

    @Override
    public String getType() {
        return "XML_SORT";
    }

    public static Response sortXml(String xml, boolean sortNestedElements, boolean caseSensitive) {
        try{
            JsonNode root = xmlMapper.readTree(xml.getBytes());
            JsonNode sorted = sortNode(root, sortNestedElements, caseSensitive);
            xmlMapper.configure(ToXmlGenerator.Feature.WRITE_XML_DECLARATION, true);
            return new Response(true, "success",
                    xmlMapper.writer().withRootName("root").writeValueAsString(sorted),
                    HttpStatus.OK.toString()
            );
        } catch (Exception e) {
            throw new RuntimeException("Invalid XML input");
        }
    }

    private static JsonNode sortNode(JsonNode node, boolean sortNested, boolean caseSensitive) {
        if (node.isObject()) {
            return sortObject((ObjectNode) node, sortNested, caseSensitive);
        }
        if (node.isArray()) {
            return sortArrayPreserveOrder((ArrayNode) node, sortNested, caseSensitive);
        }
        return node;
    }

    private static ObjectNode sortObject(ObjectNode objectNode, boolean sortNested, boolean caseSensitive) {
        ObjectNode sorted = xmlMapper.createObjectNode();

        List<String> fields = new ArrayList<>();
        objectNode.fieldNames().forEachRemaining(fields::add);

        fields.sort(caseSensitive ? Comparator.naturalOrder() : String.CASE_INSENSITIVE_ORDER);

        for (String field : fields) {
            JsonNode value = objectNode.get(field);
            if (sortNested) {
                value = sortNode(value, true, caseSensitive);
            }
            sorted.set(field, value);
        }

        return sorted;
    }

    private static ArrayNode sortArrayPreserveOrder(ArrayNode arrayNode, boolean sortNested, boolean caseSensitive) {
        ArrayNode result = xmlMapper.createArrayNode();

        for (JsonNode element : arrayNode) {
            if (sortNested) {
                result.add(sortNode(element, true, caseSensitive));
            } else {
                result.add(element);
            }
        }

        return result;
    }

}
