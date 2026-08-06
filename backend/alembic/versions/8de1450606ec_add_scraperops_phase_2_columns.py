"""Add ScraperOps Phase 2 columns

Revision ID: 8de1450606ec
Revises: 723903c36e6c
Create Date: 2026-07-05 10:51:14.642969

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = '8de1450606ec'
down_revision: Union[str, Sequence[str], None] = '723903c36e6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to events
    op.add_column('events', sa.Column('extraction_confidence', sa.Float(), nullable=True))
    op.add_column('events', sa.Column('extraction_method', sa.String(), nullable=True))
    op.add_column('events', sa.Column('review_status', sa.String(), server_default='pending', nullable=True))

    # Add columns to scraper_runs
    op.add_column('scraper_runs', sa.Column('was_healed', sa.Integer(), server_default='0', nullable=True))
    op.add_column('scraper_runs', sa.Column('healing_confidence', sa.Float(), nullable=True))

    # Create llm_usage table
    op.create_table('llm_usage',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('run_id', sa.UUID(), nullable=True),
        sa.Column('prompt_tokens', sa.Integer(), nullable=True),
        sa.Column('completion_tokens', sa.Integer(), nullable=True),
        sa.Column('total_tokens', sa.Integer(), nullable=True),
        sa.Column('cost_estimate_usd', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['run_id'], ['scraper_runs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('llm_usage')
    
    op.drop_column('scraper_runs', 'healing_confidence')
    op.drop_column('scraper_runs', 'was_healed')
    
    op.drop_column('events', 'review_status')
    op.drop_column('events', 'extraction_method')
    op.drop_column('events', 'extraction_confidence')
