"""knowledge_graph

Revision ID: d91a1a5b84c0
Revises: ec4d76f63da2
Create Date: 2026-07-04 10:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd91a1a5b84c0'
down_revision: Union[str, Sequence[str], None] = 'ec4d76f63da2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### sports ###
    op.create_table('sports',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('wikipedia_url', sa.String(), nullable=True),
        sa.Column('icon', sa.String(), nullable=True),
        sa.Column('glossary', postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sports_slug'), 'sports', ['slug'], unique=True)

    # ### organizations ###
    op.create_table('organizations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('acronym', sa.String(), nullable=True),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('org_type', sa.String(), nullable=False),
        sa.Column('scope', sa.String(), nullable=False),
        sa.Column('sport_id', sa.UUID(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('website_url', sa.String(), nullable=True),
        sa.Column('wikipedia_url', sa.String(), nullable=True),
        sa.Column('metadata_json', postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(['sport_id'], ['sports.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_organizations_org_type'), 'organizations', ['org_type'], unique=False)
    op.create_index(op.f('ix_organizations_slug'), 'organizations', ['slug'], unique=True)
    op.create_index(op.f('ix_organizations_sport_id'), 'organizations', ['sport_id'], unique=False)

    # ### org_relationships ###
    op.create_table('org_relationships',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('parent_org_id', sa.UUID(), nullable=False),
        sa.Column('child_org_id', sa.UUID(), nullable=False),
        sa.Column('relationship_type', sa.String(), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['child_org_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['parent_org_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_org_relationships_child_org_id'), 'org_relationships', ['child_org_id'], unique=False)
    op.create_index(op.f('ix_org_relationships_parent_org_id'), 'org_relationships', ['parent_org_id'], unique=False)

    # ### competitions ###
    op.create_table('competitions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('sport_id', sa.UUID(), nullable=False),
        sa.Column('organizer_id', sa.UUID(), nullable=True),
        sa.Column('competition_type', sa.String(), nullable=False),
        sa.Column('tier_level', sa.Integer(), nullable=True),
        sa.Column('gender', sa.String(), nullable=True),
        sa.Column('age_group', sa.String(), nullable=True),
        sa.Column('format', sa.String(), nullable=True),
        sa.Column('website_url', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['organizer_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['sport_id'], ['sports.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_competitions_sport_id'), 'competitions', ['sport_id'], unique=False)

    # ### competition_sanctioners ###
    op.create_table('competition_sanctioners',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('competition_id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['competition_id'], ['competitions.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # ### seasons ###
    op.create_table('seasons',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('competition_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=True),
        sa.Column('end_date', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['competition_id'], ['competitions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_seasons_competition_id'), 'seasons', ['competition_id'], unique=False)

    # ### discovery_sources ###
    op.create_table('discovery_sources',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('source_type', sa.String(), nullable=False),
        sa.Column('source_url', sa.String(), nullable=True),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('verified', sa.Integer(), nullable=True),
        sa.Column('discovered_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_discovery_sources_entity_id'), 'discovery_sources', ['entity_id'], unique=False)
    op.create_index(op.f('ix_discovery_sources_entity_type'), 'discovery_sources', ['entity_type'], unique=False)

    # ### events updates ###
    op.add_column('events', sa.Column('sport_id', sa.UUID(), nullable=True))
    op.add_column('events', sa.Column('competition_id', sa.UUID(), nullable=True))
    op.add_column('events', sa.Column('season_id', sa.UUID(), nullable=True))
    op.add_column('events', sa.Column('sport_name_raw', sa.String(), nullable=True))
    op.add_column('events', sa.Column('event_type', sa.String(), nullable=True))
    
    # Rename existing 'sport' to 'sport_name_raw' in data if we cared, but let's just 
    # run an execute statement to copy it over.
    op.execute('UPDATE events SET sport_name_raw = sport')
    
    op.create_foreign_key(None, 'events', 'competitions', ['competition_id'], ['id'])
    op.create_foreign_key(None, 'events', 'seasons', ['season_id'], ['id'])
    op.create_foreign_key(None, 'events', 'sports', ['sport_id'], ['id'])
    op.drop_column('events', 'sport')

    # ### venues updates ###
    op.add_column('venues', sa.Column('venue_type', sa.String(), nullable=True))
    op.add_column('venues', sa.Column('capacity', sa.Integer(), nullable=True))


def downgrade() -> None:
    # ### venues updates ###
    op.drop_column('venues', 'capacity')
    op.drop_column('venues', 'venue_type')

    # ### events updates ###
    op.add_column('events', sa.Column('sport', sa.String(), autoincrement=False, nullable=True))
    op.execute('UPDATE events SET sport = sport_name_raw')
    op.alter_column('events', 'sport', nullable=False)
    
    op.drop_constraint(None, 'events', type_='foreignkey')
    op.drop_constraint(None, 'events', type_='foreignkey')
    op.drop_constraint(None, 'events', type_='foreignkey')
    op.drop_column('events', 'event_type')
    op.drop_column('events', 'sport_name_raw')
    op.drop_column('events', 'season_id')
    op.drop_column('events', 'competition_id')
    op.drop_column('events', 'sport_id')

    # ### drop tables ###
    op.drop_index(op.f('ix_discovery_sources_entity_type'), table_name='discovery_sources')
    op.drop_index(op.f('ix_discovery_sources_entity_id'), table_name='discovery_sources')
    op.drop_table('discovery_sources')
    
    op.drop_index(op.f('ix_seasons_competition_id'), table_name='seasons')
    op.drop_table('seasons')
    
    op.drop_table('competition_sanctioners')
    
    op.drop_index(op.f('ix_competitions_sport_id'), table_name='competitions')
    op.drop_table('competitions')
    
    op.drop_index(op.f('ix_org_relationships_parent_org_id'), table_name='org_relationships')
    op.drop_index(op.f('ix_org_relationships_child_org_id'), table_name='org_relationships')
    op.drop_table('org_relationships')
    
    op.drop_index(op.f('ix_organizations_sport_id'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_slug'), table_name='organizations')
    op.drop_index(op.f('ix_organizations_org_type'), table_name='organizations')
    op.drop_table('organizations')
    
    op.drop_index(op.f('ix_sports_slug'), table_name='sports')
    op.drop_table('sports')
