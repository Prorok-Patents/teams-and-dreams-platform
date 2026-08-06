"""merge heads

Revision ID: 723903c36e6c
Revises: 87f5493bd80c, d91a1a5b84c0
Create Date: 2026-07-04 11:42:55.746811

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = '723903c36e6c'
down_revision: Union[str, Sequence[str], None] = ('87f5493bd80c', 'd91a1a5b84c0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
