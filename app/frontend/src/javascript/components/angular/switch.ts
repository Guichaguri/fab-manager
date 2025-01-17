/**
 * This is a compatibility wrapper to allow usage of react-switch inside the angular.js app
 */
import Switch from 'react-switch';
import { react2angular } from 'react2angular';
import { IApplication } from '../../models/application';

declare const Application: IApplication;

Application.Components.component('switch', react2angular(Switch, ['checked', 'onChange', 'id', 'className', 'disabled']));
