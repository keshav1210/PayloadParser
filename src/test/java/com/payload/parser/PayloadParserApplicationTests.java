package com.payload.parser;

import com.github.benmanes.caffeine.cache.Cache;
import com.payload.parser.controller.RequestHandler;
import com.payload.parser.controller.ViewHandler;
import com.payload.parser.model.ShareMeta;
import com.payload.parser.model.ShareResponse;
import com.payload.parser.model.ShareTextRequest;
import com.payload.parser.service.EmailService;
import com.payload.parser.service.ShareService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class PayloadParserApplicationTests {

	@Autowired
	private ShareService shareService;

	@Autowired
	private Cache<String, ShareMeta> cache;

	@Autowired
	private ViewHandler viewHandler;

	@Autowired
	private RequestHandler requestHandler;

	@Autowired
	private EmailService emailService;

	@Test
	void contextLoads() {
	}

	@Test
	void testSourcePagePreservationAndRedirect() throws Exception {
		String text = "{\"name\":\"test\"}";
		String sourcePage = "/json-parser";
		String token = shareService.saveText(text, false, sourcePage);

		assertNotNull(token);
		ShareMeta meta = cache.getIfPresent(token);
		assertNotNull(meta);
		assertEquals(sourcePage, meta.getSourcePage());

		// ViewHandler should redirect to origin page with ?drop={token}
		ResponseEntity<?> response = viewHandler.accessData(token);
		assertEquals(HttpStatus.FOUND, response.getStatusCode());
		assertEquals("/json-parser?drop=" + token, response.getHeaders().getLocation().toString());

		// RequestHandler should return raw content without clearing non-onetime drop
		ResponseEntity<?> dataResponse = requestHandler.access(token);
		assertEquals(HttpStatus.OK, dataResponse.getStatusCode());
		assertEquals(text, dataResponse.getBody());
	}

	@Test
	void testShareFromGenericSharePageOutputsHtml() throws Exception {
		String text = "Simple note";
		String token = shareService.saveText(text, false, "/share");

		ResponseEntity<?> response = viewHandler.accessData(token);
		assertEquals(HttpStatus.OK, response.getStatusCode());
	}

	@Test
	void testShareTextWithEmailFallback() {
		ShareTextRequest req = new ShareTextRequest();
		req.setText("Hello World");
		req.setSourcePage("/xml-parser");
		req.setEmail("user@example.com");

		ResponseEntity<ShareResponse> resp = requestHandler.shareText(req);
		assertEquals(HttpStatus.OK, resp.getStatusCode());
		assertNotNull(resp.getBody());
		assertTrue(resp.getBody().isSuccess());
		assertNotNull(resp.getBody().getToken());
		// Without SMTP configured in test, mailtoUrl fallback is generated
		assertNotNull(resp.getBody().getMailtoUrl());
		assertTrue(resp.getBody().getMailtoUrl().startsWith("mailto:user@example.com"));
		assertTrue(resp.getBody().getMailtoUrl().contains(resp.getBody().getToken()));
	}

	@Test
	void testMailtoUrlGeneration() {
		String mailto = emailService.generateMailtoUrl("friend@example.com", "abc12", "http://localhost:8085/shared/abc12", "/json-parser");
		assertNotNull(mailto);
		assertTrue(mailto.startsWith("mailto:friend@example.com"));
		assertTrue(mailto.contains("abc12"));
	}

}
