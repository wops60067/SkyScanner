import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Watcher {
  id?: number;
  fly_from: string;
  fly_to: string;
  date_from: string;
  date_to: string;
  curr?: string;
  targetPrice: number;
  emailUser: string;
  lastPrice?: number;
  lastCheckedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlightResult {
  id: number;
  watcherId: number;
  price: number;
  origin: string;
  destination: string;
  date: string;
  airline: string;
  deepLink: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class WatcherService {
  private apiUrl = 'http://localhost:3000/api/watchers';

  constructor(private http: HttpClient) { }

  getWatchers(): Observable<Watcher[]> {
    return this.http.get<Watcher[]>(this.apiUrl);
  }

  addWatcher(watcher: Watcher): Observable<Watcher> {
    return this.http.post<Watcher>(this.apiUrl, watcher);
  }

  deleteWatcher(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getResults(): Observable<FlightResult[]> {
    return this.http.get<FlightResult[]>(`http://localhost:3000/api/results`);
  }
}
