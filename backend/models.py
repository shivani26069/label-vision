from sqlalchemy import Column, String, DateTime, Text, Float, JSON
from sqlalchemy.sql import func
from database import Base

class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(String, primary_key=True, index=True)
    raw_text = Column(Text, nullable=False)
    extracted_json = Column(JSON, nullable=False)
    confidence = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
