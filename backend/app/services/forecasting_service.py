import os
import pandas as pd
import numpy as np
from typing import List, Dict, Optional
from statsmodels.tsa.holtwinters import ExponentialSmoothing


class ForecastingService:
    def __init__(self):
        self.data_path = os.path.normpath(
            os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                "..", "data", "synthetic_demand_history.csv"
            )
        )
        self.data: Optional[pd.DataFrame] = None
        self.product_list: List[dict] = []
        self._loaded = False

    def load(self):
        if not os.path.exists(self.data_path):
            print(f"Synthetic demand data not found at {self.data_path}")
            return

        self.data = pd.read_csv(self.data_path)
        self.data['date'] = pd.to_datetime(self.data['date'])
        self.data = self.data.sort_values(['product_id', 'date']).reset_index(drop=True)

        prod_df = self.data[['product_id', 'product_name', 'category']].drop_duplicates('product_id')
        self.product_list = prod_df.to_dict('records')

        self._loaded = True
        print(f"Forecasting service loaded: {len(self.product_list)} products, {len(self.data)} records")

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def get_products(self) -> List[dict]:
        return self.product_list

    def forecast(self, product_id: int, horizon: int = 7) -> dict:
        if not self._loaded:
            raise RuntimeError("Forecasting service not loaded. Synthetic demand data missing.")

        prod_data = self.data[self.data['product_id'] == product_id].copy()
        if len(prod_data) < 14:
            raise ValueError(f"Insufficient historical data for product_id={product_id}")

        series = prod_data['demand'].values.astype(float)

        if np.std(series) < 0.01:
            forecast_vals = np.full(horizon, series[-1])
        else:
            try:
                model = ExponentialSmoothing(
                    series,
                    trend='add',
                    seasonal='add',
                    seasonal_periods=min(7, len(series) // 2),
                    initialization_method='estimated',
                )
                fitted = model.fit()
                forecast_vals = fitted.forecast(horizon)
            except Exception:
                last_val = series[-1]
                trend_val = (series[-1] - series[0]) / max(len(series) - 1, 1)
                forecast_vals = np.array([max(1, last_val + trend_val * (i + 1)) for i in range(horizon)])

        forecast_vals = np.maximum(1, np.round(forecast_vals))

        last_date = prod_data['date'].iloc[-1]

        historical = [
            {'date': str(r['date'].date()), 'demand': int(r['demand'])}
            for _, r in prod_data.iterrows()
        ]

        forecast = [
            {'date': (last_date + pd.Timedelta(days=i + 1)).strftime('%Y-%m-%d'), 'predicted_demand': int(v)}
            for i, v in enumerate(forecast_vals)
        ]

        avg_forecast = int(round(float(np.mean(forecast_vals))))
        peak_forecast = int(round(float(np.max(forecast_vals))))
        if len(forecast_vals) > 1:
            trend_dir = "Increasing" if forecast_vals[-1] > forecast_vals[0] else "Decreasing" if forecast_vals[-1] < forecast_vals[0] else "Stable"
        else:
            trend_dir = "Stable"

        product_name = str(prod_data['product_name'].iloc[0]) if len(prod_data) > 0 and 'product_name' in prod_data.columns else None

        return {
            'product_id': product_id,
            'product_name': product_name,
            'forecast_horizon': horizon,
            'model': 'Holt-Winters Exponential Smoothing',
            'historical': historical,
            'forecast': forecast,
            'summary': {
                'average_forecast': avg_forecast,
                'peak_forecast': peak_forecast,
                'trend': trend_dir,
            },
        }

    def forecast_overview(self) -> List[dict]:
        if not self._loaded:
            return []

        results = []
        all_product_ids = self.data['product_id'].unique()
        sample = all_product_ids[:min(10, len(all_product_ids))]

        for pid in sample:
            try:
                result = self.forecast(int(pid), horizon=7)
                results.append(result)
            except Exception:
                continue

        return results


forecasting_service = ForecastingService()
