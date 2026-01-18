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
import java.util.Stack;

@Service
public class XmlFormatServiceImpl implements ParserService {
    @Override
    public Response parse(Request request) {

        Response response=null;
    try {
        String input=repair(request.getData().trim());
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setIgnoringElementContentWhitespace(true);
    DocumentBuilder builder = factory.newDocumentBuilder();
    Document document = builder.parse(
            new InputSource(new StringReader(input))
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


//    public String repair(String xml) {
//        if (xml == null || xml.trim().isEmpty()) {
//            return xml;
//        }
//
//        Stack<String> stack = new Stack<>();
//        StringBuilder result = new StringBuilder();
//        int i = 0;
//
//        while (i < xml.length()) {
//            if (xml.charAt(i) != '<') {
//                result.append(xml.charAt(i));
//                i++;
//                continue;
//            }
//
//            // Found <, find the matching >
//            int start = i;
//            int end = xml.indexOf('>', i);
//
//            if (end == -1) {
//                // No closing >, just append rest
//                result.append(xml.substring(i));
//                break;
//            }
//
//            // Get the tag content
//            String tag = xml.substring(start, end + 1);
//            String content = xml.substring(start + 1, end).trim();
//
//            result.append(tag);
//            i = end + 1;
//
//            // Skip special tags
//            if (content.startsWith("?") || content.startsWith("!") || content.isEmpty()) {
//                continue;
//            }
//
//            // Check if closing tag
//            if (content.startsWith("/")) {
//                // Closing tag
//                String tagName = getTagName(content.substring(1));
//                if (!stack.isEmpty() && stack.peek().equals(tagName)) {
//                    stack.pop();
//                }
//            } else if (!content.endsWith("/")) {
//                // Opening tag (not self-closing)
//                String tagName = getTagName(content);
//                stack.push(tagName);
//            }
//        }
//
//        // Close all remaining tags
//        while (!stack.isEmpty()) {
//            String tagName = stack.pop();
//            result.append("</").append(tagName).append(">");
//        }
//
//        return result.toString();
//    }

    private String getTagName(String content) {
        // Get tag name - stop at space or special char
        StringBuilder name = new StringBuilder();
        for (char c : content.toCharArray()) {
            if (c == ' ' || c == '\t' || c == '\n' || c == '/' || c == '>') {
                break;
            }
            name.append(c);
        }
        return name.toString().trim();
    }

    public String repair(String xml) {
        if (xml == null || xml.trim().isEmpty()) {
            return xml;
        }

        Stack<String> stack = new Stack<>();
        StringBuilder result = new StringBuilder();
        int i = 0;

        while (i < xml.length()) {
            if (xml.charAt(i) != '<') {
                result.append(xml.charAt(i));
                i++;
                continue;
            }

            // Found <, find the matching >
            int start = i;
            int end = xml.indexOf('>', i);

            if (end == -1) {
                // No closing >, just append rest
                result.append(xml.substring(i));
                break;
            }

            // Get the tag content
            String tag = xml.substring(start, end + 1);
            String content = xml.substring(start + 1, end).trim();

            i = end + 1;

            // Skip special tags
            if (content.startsWith("?") || content.startsWith("!") || content.isEmpty()) {
                result.append(tag);
                continue;
            }

            // Check if closing tag
            if (content.startsWith("/")) {
                // Closing tag
                String tagName = getTagName(content.substring(1));

                if (!stack.isEmpty() && stack.peek().equals(tagName)) {
                    // PERFECT MATCH - pop and append
                    stack.pop();
                    result.append(tag);
                } else if (!stack.isEmpty()) {
                    // MISMATCH!
                    // Check if this closing tag exists deeper in stack
                    int matchIndex = -1;
                    for (int j = stack.size() - 1; j >= 0; j--) {
                        if (stack.get(j).equals(tagName)) {
                            matchIndex = j;
                            break;
                        }
                    }

                    if (matchIndex >= 0) {
                        // Found in stack - close all tags above it
                        while (stack.size() > matchIndex) {
                            String toClose = stack.pop();
                            result.append("</").append(toClose).append(">");
                        }
                        // The matching tag is already popped in the loop above
                        // So DON'T append the original tag again
                    } else {
                        // Tag NOT in stack - skip this wrong closing tag
                        // Don't append it
                    }
                } else {
                    // Stack empty - extra closing tag, skip it
                }
            } else if (!content.endsWith("/")) {
                // Opening tag (not self-closing)
                String tagName = getTagName(content);
                stack.push(tagName);
                result.append(tag);
            } else {
                // Self-closing tag
                result.append(tag);
            }
        }

        // Close all remaining tags
        while (!stack.isEmpty()) {
            String tagName = stack.pop();
            result.append("</").append(tagName).append(">");
        }

        return result.toString();
    }

}

