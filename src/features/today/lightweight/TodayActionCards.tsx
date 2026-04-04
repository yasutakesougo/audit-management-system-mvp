import { Button, Card, CardActions, CardContent, Grid, Stack, Typography } from '@mui/material';
import React from 'react';

export type TodayActionCardItem = {
  key: string;
  title: string;
  count: number;
  primaryLabel: string;
  onPrimaryClick: () => void;
};

export type TodayActionCardsProps = {
  cards: TodayActionCardItem[];
};

export const TodayActionCards: React.FC<TodayActionCardsProps> = ({ cards }) => {
  const CARD_ORDER: Record<string, number> = {
    attendance: 0,
    record: 1,
    handoff: 2,
    meeting: 3,
  };
  const safeCards = [...cards]
    .sort((a, b) => {
      const orderA = CARD_ORDER[a.key] ?? Number.MAX_SAFE_INTEGER;
      const orderB = CARD_ORDER[b.key] ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title, 'ja');
    })
    .slice(0, 4);

  return (
    <Grid container spacing={1.5} data-testid="today-lite-action-cards">
      {safeCards.map((card) => (
        <Grid size={{ xs: 12, sm: 6 }} key={card.key}>
          <Card variant="outlined" data-testid={`today-lite-action-card-${card.key}`}>
            <CardContent>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1" fontWeight={700}>{card.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  未完了 {card.count}件
                </Typography>
              </Stack>
            </CardContent>
            <CardActions>
              <Button
                variant="contained"
                fullWidth
                onClick={card.onPrimaryClick}
                data-testid={`today-lite-action-${card.key}`}
              >
                {card.primaryLabel}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default TodayActionCards;
