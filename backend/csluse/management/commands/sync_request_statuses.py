import json

from django.core.management.base import BaseCommand

from csluse.viewsets import (
    sync_booking_statuses,
    sync_borrow_statuses,
)


SYNC_HANDLERS = {
    "booking": sync_booking_statuses,
    "borrow": sync_borrow_statuses,
}


class Command(BaseCommand):
    help = "Synchronize request lifecycle statuses such as expired, completed, and overdue."

    def add_arguments(self, parser):
        parser.add_argument(
            "--target",
            dest="targets",
            action="append",
            choices=tuple(SYNC_HANDLERS.keys()),
            help="Limit sync to specific request types. Repeat the flag to include multiple targets.",
        )
        parser.add_argument(
            "--quiet",
            action="store_true",
            help="Print a compact JSON summary suitable for cron logs.",
        )

    def handle(self, *args, **options):
        targets = options["targets"] or list(SYNC_HANDLERS.keys())
        quiet = options["quiet"]
        summary = {}

        for target in targets:
            summary[target] = SYNC_HANDLERS[target]()

        if quiet:
            self.stdout.write(json.dumps(summary, sort_keys=True))
            return

        self.stdout.write(self.style.SUCCESS("Request status sync completed."))
        for target in targets:
            self.stdout.write(f"{target}: {json.dumps(summary[target], sort_keys=True)}")
