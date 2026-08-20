from pydantic import BaseModel, ConfigDict, Field


class TestUser(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=1, max_length=1024)
    display_name: str | None = Field(default=None, max_length=256)


class JourneyResult(BaseModel):
    journey_id: str
    success: bool
    details: str | None = None


demo_user = TestUser(email="demo@example.com", password="P@ssword123", display_name="Demo User")
