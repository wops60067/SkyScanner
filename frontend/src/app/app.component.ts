import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WatcherFormComponent } from './components/watcher-form/watcher-form.component';
import { WatcherListComponent } from './components/watcher-list/watcher-list.component';
import { WatcherService, Watcher } from './services/watcher.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, WatcherFormComponent, WatcherListComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'FlightTracker';
  watchers: Watcher[] = [];

  constructor(private watcherService: WatcherService) {}

  ngOnInit() {
    this.loadWatchers();
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

  onDeleteWatcher(id: number) {
    this.watcherService.deleteWatcher(id).subscribe({
      next: () => {
        this.loadWatchers(); // Reload list after deletion
      },
      error: (err) => {
        console.error('Failed to delete watcher', err);
      }
    });
  }
}
