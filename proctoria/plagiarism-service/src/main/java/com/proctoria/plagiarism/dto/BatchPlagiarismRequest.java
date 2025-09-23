package com.proctoria.plagiarism.dto;

import java.util.List;
import java.util.UUID;

public class BatchPlagiarismRequest {
    private UUID sessionId;
    private List<String> texts;
    private String language;
    private List<String> filenames;
    
    public BatchPlagiarismRequest() {}
    
    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }
    
    public List<String> getTexts() { return texts; }
    public void setTexts(List<String> texts) { this.texts = texts; }
    
    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }
    
    public List<String> getFilenames() { return filenames; }
    public void setFilenames(List<String> filenames) { this.filenames = filenames; }
}