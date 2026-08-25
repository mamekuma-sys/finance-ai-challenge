import logging

from rwa_guard.config import get_settings


def main() -> None:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("rwa_guard.worker").info(
        "worker scaffold ready; app_env=%s p1_chain=%s",
        settings.app_env,
        "configured" if settings.kaia_rpc_url else "disabled",
    )


if __name__ == "__main__":
    main()
