package com.payload.parser.serviceImpl;

import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Sorts child elements alphabetically at every level.
 * Works on a real DOM so attributes, text, comments, CDATA and namespaces are kept;
 * only the order of sibling elements changes (the sort is stable, so repeated
 * elements with the same name keep their relative order).
 */
@Service
public class XmlSortServiceImpl implements ParserService {

    @Override
    public Response parse(Request request) {
        return sortXml(request.getData(), true, false);
    }

    @Override
    public String getType() {
        return "XML_SORT";
    }

    public static Response sortXml(String xml, boolean sortNestedElements, boolean caseSensitive) {
        try {
            Document doc = newSecureBuilder().parse(new InputSource(new StringReader(xml)));
            Comparator<Element> byName = Comparator.comparing(
                    Element::getNodeName,
                    caseSensitive ? Comparator.naturalOrder() : String.CASE_INSENSITIVE_ORDER);
            sortChildren(doc.getDocumentElement(), byName, sortNestedElements);
            return new Response(true, "success", serialize(doc), HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException("Invalid XML input");
        }
    }

    private static void sortChildren(Element parent, Comparator<Element> byName, boolean recursive) {
        List<Node> others = new ArrayList<>();
        List<Element> elements = new ArrayList<>();

        NodeList children = parent.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() == Node.ELEMENT_NODE) {
                elements.add((Element) child);
            } else if (!(child.getNodeType() == Node.TEXT_NODE && child.getTextContent().isBlank())) {
                others.add(child);   // text, comments, CDATA, processing instructions
            }
        }

        while (parent.hasChildNodes()) {
            parent.removeChild(parent.getFirstChild());
        }

        // Non-element content first, in its original order, then the sorted elements
        others.forEach(parent::appendChild);
        elements.sort(byName);
        for (Element element : elements) {
            parent.appendChild(element);
            if (recursive) {
                sortChildren(element, byName, true);
            }
        }
    }

    private static DocumentBuilder newSecureBuilder() throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        // Block DOCTYPEs and external entities (XXE)
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory.newDocumentBuilder();
    }

    private static String serialize(Document doc) throws Exception {
        TransformerFactory factory = TransformerFactory.newInstance();
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
        Transformer transformer = factory.newTransformer();
        transformer.setOutputProperty(OutputKeys.INDENT, "yes");
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2");
        doc.setXmlStandalone(true);

        StringWriter out = new StringWriter();
        transformer.transform(new DOMSource(doc), new StreamResult(out));
        // The JDK transformer writes the root element on the same line as the declaration
        return out.toString().trim().replaceFirst("^(<\\?xml[^>]*\\?>)\\s*", "$1\n");
    }
}
