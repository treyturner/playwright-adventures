from pydantic import BaseModel


class TestUser(BaseModel):
    email: str
    password: str
    display_name: str | None = None


class JourneyResult(BaseModel):
    journey_id: str
    success: bool
    details: str | None = None


demo_user = TestUser(email="demo@example.com", password="P@ssword123", display_name="Demo User")
