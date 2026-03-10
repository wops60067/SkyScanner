import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { WatcherFormComponent } from './components/watcher-form/watcher-form.component';
import { WatcherListComponent } from './components/watcher-list/watcher-list.component';
import { WatcherService, Watcher } from './services/watcher.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, WatcherFormComponent, WatcherListComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'FlightTracker';
  watchers: Watcher[] = [];
  flightResults: any[] = [];
  private pollInterval: any;

  constructor(private watcherService: WatcherService) {}

  ngOnInit() {
    this.loadWatchers();
    this.loadResults();
    
    // Refresh results every 30 seconds
    this.pollInterval = setInterval(() => {
      this.loadResults();
      this.loadWatchers();
    }, 30000);
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  loadWatchers() {
    this.watcherService.getWatchers().subscribe({
      next: (data) => {
        this.watchers = data;
      },
      error: (err) => {
        console.error('Failed to load watchers', err);
      }
    });
  }

  loadResults() {
    this.watcherService.getResults().subscribe({
      next: (data) => {
        console.log(`[Flight Tracker] ✈️ Successfully loaded ${data.length} deals from API.`);
        if (data.length > 0) {
          console.table(data); // Using table view for clearer inspection
        }
        this.flightResults = data;
        this.sortResults('price'); // Default sort by price
      },
      error: (err) => {
        console.error('Failed to load flight results', err);
      }
    });
  }

  sortResults(type: string) {
    if (type === 'price') {
      this.flightResults.sort((a, b) => a.price - b.price);
    } else if (type === 'date') {
      this.flightResults.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (type === 'route') {
      this.flightResults.sort((a, b) => a.origin.localeCompare(b.origin));
    } else if (type === 'airline') {
      this.flightResults.sort((a, b) => a.airline.localeCompare(b.airline));
    }
  }

  onDeleteWatcher(id: number) {
    this.watcherService.deleteWatcher(id).subscribe({
      next: () => {
        this.loadWatchers(); 
        this.loadResults();
      },
      error: (err) => {
        console.error('Failed to delete watcher', err);
      }
    });
  }
}
