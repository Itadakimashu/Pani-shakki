"""IVR and SMS adapter interfaces (stubbed).

Real deployments would plug in a Bangladeshi SMS gateway / IVR provider (or a
telco's 2-way SMS shortcode) behind these interfaces. Select implementations
with settings.SMS_ADAPTER / settings.IVR_ADAPTER. See docs/api.md.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from django.conf import settings
from django.utils.module_loading import import_string

log = logging.getLogger("pani")


@dataclass
class DeliveryResult:
    channel: str
    to: str
    ok: bool
    provider_id: str = ""
    detail: str = ""
    at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class SMSAdapter:
    """Outbound SMS + parsing of inbound SMS webhooks."""
    def send(self, to: str, text: str) -> DeliveryResult:  # pragma: no cover - interface
        raise NotImplementedError

    def parse_inbound(self, payload: dict) -> dict:
        """Map a provider webhook payload to {from, text}. Override per provider."""
        return {"from": payload.get("from", ""), "text": payload.get("text", "")}


class IVRAdapter:
    """Outbound voice calls that read a Bangla message (TTS or pre-recorded audio),
    and inbound calls where a recording/transcript becomes a report."""
    def call(self, to: str, text_bn: str, audio_url: str | None = None) -> DeliveryResult:  # pragma: no cover
        raise NotImplementedError

    def parse_inbound(self, payload: dict) -> dict:
        """Map a provider webhook to {from, text, audio_url}. `text` may come from the
        provider's speech-to-text, or be empty and transcribed later."""
        return {"from": payload.get("from", ""), "text": payload.get("transcript", ""),
                "audio_url": payload.get("recording_url")}


class ConsoleSMSAdapter(SMSAdapter):
    """Dev adapter: prints instead of sending. Keeps an in-memory outbox for tests."""
    outbox: list[DeliveryResult] = []

    def send(self, to, text):
        log.info("[SMS → %s] %s", to, text)
        res = DeliveryResult("sms", to, True, provider_id=f"console-{len(self.outbox) + 1}", detail=text)
        self.outbox.append(res)
        return res


class ConsoleIVRAdapter(IVRAdapter):
    outbox: list[DeliveryResult] = []

    def call(self, to, text_bn, audio_url=None):
        log.info("[IVR call → %s] %s %s", to, text_bn, audio_url or "")
        res = DeliveryResult("ivr", to, True, provider_id=f"console-call-{len(self.outbox) + 1}", detail=text_bn)
        self.outbox.append(res)
        return res


def sms_adapter() -> SMSAdapter:
    return import_string(settings.SMS_ADAPTER)()


def ivr_adapter() -> IVRAdapter:
    return import_string(settings.IVR_ADAPTER)()
