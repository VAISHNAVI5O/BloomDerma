package com.bloomderma.api.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/** JWT = header.payload.signature. Stateless: the server stores nothing between requests. */
@Component
public class JwtTokenProvider {
    private final SecretKey key;
    private final long expirationMs;

    public JwtTokenProvider(@Value("${bloomderma.jwt.secret}") String secret,
                            @Value("${bloomderma.jwt.expiration-ms}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }
    public String generate(String username, String role) { return generate(username, role, null, null); }

    public String generate(String username, String role, String doctorId) { return generate(username, role, doctorId, null); }

    public String generate(String username, String role, String doctorId, String patientId) {
        Date now = new Date();
        JwtBuilder b = Jwts.builder().subject(username).claim("role", role);
        if (doctorId != null) b.claim("doctorId", doctorId);   // for the UI only; the server re-reads it from the DB
        if (patientId != null) b.claim("patientId", patientId);
        return b.issuedAt(now).expiration(new Date(now.getTime() + expirationMs)).signWith(key).compact();
    }
    /** Returns claims if the signature and expiry are valid, otherwise throws JwtException. */
    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
