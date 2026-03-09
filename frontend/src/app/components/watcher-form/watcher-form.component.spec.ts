import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WatcherFormComponent } from './watcher-form.component';

describe('WatcherFormComponent', () => {
  let component: WatcherFormComponent;
  let fixture: ComponentFixture<WatcherFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WatcherFormComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WatcherFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
