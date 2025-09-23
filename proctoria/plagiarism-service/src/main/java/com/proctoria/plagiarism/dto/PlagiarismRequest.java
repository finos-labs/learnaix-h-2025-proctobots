package com.proctoria.plagiarism.dto;

import java.util.UUID;

public class PlagiarismRequest {
    private UUID sessionId;
    private String text;
    private String language;
    private String filename;
    
    public PlagiarismRequest() {}
    
    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }
    
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    
    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }
}