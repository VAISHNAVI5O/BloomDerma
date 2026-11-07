package com.bloomderma.api.exception;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.stream.Collectors;

/** One place that turns Java exceptions into clean JSON + correct HTTP status codes. */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private ResponseEntity<Map<String, Object>> body(HttpStatus s, String msg) {
        return ResponseEntity.status(s).body(Map.of("timestamp", LocalDateTime.now().toString(),
                "status", s.value(), "error", s.getReasonPhrase(), "message", String.valueOf(msg)));
    }
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<?> notFound(ResourceNotFoundException e) { return body(HttpStatus.NOT_FOUND, e.getMessage()); }
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<?> denied(org.springframework.security.access.AccessDeniedException e) {
        return body(HttpStatus.FORBIDDEN, e.getMessage() == null ? "You are not allowed to do this." : e.getMessage()); }
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<?> tooLarge(org.springframework.web.multipart.MaxUploadSizeExceededException e) {
        return body(HttpStatus.PAYLOAD_TOO_LARGE, "File is too large (maximum 10 MB)."); }
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<?> conflict(ConflictException e) { return body(HttpStatus.CONFLICT, e.getMessage()); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> integrity(DataIntegrityViolationException e) {
        return body(HttpStatus.CONFLICT, "Record is in use or violates a database constraint."); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> invalid(MethodArgumentNotValidException e) {
        return body(HttpStatus.BAD_REQUEST, e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage()).collect(Collectors.joining(", "))); }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> badArg(IllegalArgumentException e) { return body(HttpStatus.BAD_REQUEST, e.getMessage()); }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> other(Exception e) { return body(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage()); }
}
