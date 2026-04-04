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
  const safeCards = cards.slice(0, 4);

  return (
    <Grid container spacing={1.5} data-testid="today-lite-action-cards">
      {safeCards.map((card) => (
        <Grid size={{ xs: 12, sm: 6 }} key={card.key}>
          <Card variant="outlined">
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
