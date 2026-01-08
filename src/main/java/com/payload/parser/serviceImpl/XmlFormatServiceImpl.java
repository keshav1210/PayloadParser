package com.payload.parser.serviceImpl;

import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringReader;
import java.io.StringWriter;

@Service
public class XmlFormatServiceImpl implements ParserService {
    @Override
    public Response parse(Request request) {

        Response response=null;
    try {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setIgnoringElementContentWhitespace(true);
    DocumentBuilder builder = factory.newDocumentBuilder();
    Document document = builder.parse(
            new InputSource(new StringReader(request.getData().trim()))
    );
        document.normalize();
        removeWhitespaceNodes(document);
        Transformer transformer = TransformerFactory.newInstance().newTransformer();
        transformer.setOutputProperty(OutputKeys.INDENT, "Yes");
        transformer.setOutputProperty(
                "{http://xml.apache.org/xslt}indent-amount", "2"
        );
        StringWriter writer = new StringWriter();
        transformer.transform(new DOMSource(document), new StreamResult(writer));
        response=new Response(true,"success",writer.toString().replace("\r\n", "\n"), HttpStatus.OK.toString());
    }catch (Exception e){
        throw new IllegalArgumentException(e.getMessage());
    }
        return response;
    }
    @Override
    public String getType() {
        return "XML_FORMAT";
    }
    private void removeWhitespaceNodes(Node node) {
        NodeList children = node.getChildNodes();
        for (int i = children.getLength() - 1; i >= 0; i--) {
            Node child = children.item(i);

            if (child.getNodeType() == Node.TEXT_NODE &&
                    child.getTextContent().trim().isEmpty()) {
                node.removeChild(child);
            } else if (child.getNodeType() == Node.ELEMENT_NODE) {
                removeWhitespaceNodes(child);
            }
        }
    }

}

