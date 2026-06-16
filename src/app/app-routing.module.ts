import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { TestRunnerComponent } from './test-runner/test-runner.component';
import { PracticeRunnerComponent } from './practice-runner/practice-runner.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'test/:id', component: TestRunnerComponent },
  { path: 'test/:id/practice', component: PracticeRunnerComponent },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
